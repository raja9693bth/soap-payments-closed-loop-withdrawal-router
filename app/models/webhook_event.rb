class WebhookEvent < ActiveRecord::Base
  belongs_to :payout_leg, optional: true
end
