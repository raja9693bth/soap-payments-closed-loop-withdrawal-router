require 'spec_helper'

# Public spec — sanity-checks your wiring. Not part of grading.
RSpec.describe WithdrawalService do
  let(:provider) { MockPayoutProvider.new }
  let(:service)  { described_class.new(payout_provider: provider) }

  it 'instantiates without error' do
    expect(service).to be_a(described_class)
  end

  it 'WithdrawalService#execute is the public entry point' do
    expect(service).to respond_to(:execute)
  end
end
