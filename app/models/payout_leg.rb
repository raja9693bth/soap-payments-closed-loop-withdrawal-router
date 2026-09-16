class PayoutLeg < ActiveRecord::Base
  belongs_to :withdrawal
  belongs_to :payment_method
  has_many :webhook_events, dependent: :nullify
end
