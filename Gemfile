source 'https://rubygems.org'

ruby '~> 3.3.0'

# Core data layer — ActiveRecord without full Rails (lighter, faster boot)
gem 'activerecord', '~> 7.1'
gem 'pg', '~> 1.5'
gem 'standalone_migrations', '~> 7.1'

# JSON
gem 'json', '~> 2.7'

# Lightweight API layer
gem 'sinatra', '~> 4.1'
gem 'puma', '~> 6.4'
gem 'rack-cors', '~> 2.0'

group :development, :test do
  gem 'rspec', '~> 3.13'
  gem 'pry-byebug'
  gem 'rack-test', '~> 2.1'
end
