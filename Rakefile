# Standalone-migrations Rakefile. Lets us run `rake db:create db:migrate`
# without a full Rails app.
require 'standalone_migrations'
StandaloneMigrations::Tasks.load_tasks

namespace :db do
  desc 'Seed the sandbox database with deterministic data'
  task :seed do
    require_relative 'api/app'
    load File.expand_path('db/seeds.rb', __dir__)
  end
end
