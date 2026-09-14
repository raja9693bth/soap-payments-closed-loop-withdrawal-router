class Withdrawal < ActiveRecord::Base
  belongs_to :user
  has_many :payout_legs

  STATES = %w[pending submitted settled failed].freeze
end
