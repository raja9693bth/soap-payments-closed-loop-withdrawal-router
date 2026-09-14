class PayoutLeg < ActiveRecord::Base
  belongs_to :withdrawal
  belongs_to :payment_method
end
