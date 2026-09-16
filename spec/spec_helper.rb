# Test bootstrap: connect ActiveRecord to Postgres, run migrations, load
# the app code, reset between tests.

require 'active_record'
require 'active_support'
require 'active_support/core_ext/numeric/time'
require 'active_support/core_ext/integer/time'
require 'active_support/core_ext/date/calculations'
require 'active_support/core_ext/time/calculations'
require 'yaml'
require 'erb'
require 'pg'

# 1. Resolve DB config — honor DATABASE_URL first, then config/database.yml
db_url = ENV.fetch('DATABASE_URL', nil)
if db_url && !db_url.empty?
  ActiveRecord::Base.establish_connection(db_url)
else
  cfg_path = File.expand_path('../config/database.yml', __dir__)
  cfg = YAML.safe_load(ERB.new(File.read(cfg_path)).result, aliases: true)
  ActiveRecord::Base.establish_connection(cfg.fetch('test'))
end

# 2. Run pending migrations.
migrations_path = File.expand_path('../db/migrate', __dir__)
context = ActiveRecord::MigrationContext.new(migrations_path)
context.migrate

# 3. Load app code.
$LOAD_PATH.unshift File.expand_path('..', __dir__)
Dir[File.expand_path('../app/models/*.rb', __dir__)].sort.each { |f| require f }
Dir[File.expand_path('../app/services/*.rb', __dir__)].sort.each { |f| require f }

RSpec.configure do |config|
  config.expect_with :rspec do |c|
    c.syntax = :expect
  end

  # Clean slate between tests — truncate all tables but keep schema.
  config.before(:each) do
    tables = ActiveRecord::Base.connection.tables - ['schema_migrations', 'ar_internal_metadata']
    next if tables.empty?
    ActiveRecord::Base.connection.execute(
      "TRUNCATE TABLE #{tables.map { |t| ActiveRecord::Base.connection.quote_table_name(t) }.join(', ')} RESTART IDENTITY CASCADE"
    )
    MockPayoutProvider.reset! if defined?(MockPayoutProvider)
  end
end
