class LedgerEntry < ActiveRecord::Base
  belongs_to :user

  # The audit-trail invariant assumes timestamps are managed at insert time.
  self.record_timestamps = false

  ENTRY_TYPES = %w[deposit withdrawal_debit withdrawal_reversal adjustment].freeze
  validates :entry_type, inclusion: { in: ENTRY_TYPES }
  validates :amount_cents, numericality: { only_integer: true }

  before_update :prevent_mutation
  before_destroy :prevent_mutation

  def readonly?
    persisted?
  end

  def delete
    raise ActiveRecord::ReadOnlyRecord, "Ledger entries are strictly append-only and cannot be updated or deleted"
  end

  private

  def prevent_mutation
    raise ActiveRecord::ReadOnlyRecord, "Ledger entries are strictly append-only and cannot be updated or deleted"
  end
end
