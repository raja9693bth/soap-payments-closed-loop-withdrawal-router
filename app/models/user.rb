class User < ActiveRecord::Base
  has_many :payment_methods
  has_many :deposits
  has_many :withdrawals
  has_many :ledger_entries
end
