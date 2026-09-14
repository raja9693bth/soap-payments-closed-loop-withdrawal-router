class PaymentMethod < ActiveRecord::Base
  belongs_to :user
  has_many :deposits
  has_many :payout_legs

  ASSET_CLASSES = %w[fiat_card fiat_ach crypto].freeze
  validates :asset_class, inclusion: { in: ASSET_CLASSES }
end
