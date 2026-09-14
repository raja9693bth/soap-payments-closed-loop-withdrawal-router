# soap-payments-closed-loop-withdrawal-router
A Ruby/ActiveRecord payment withdrawal service that routes refunds to original payment instruments in FIFO order, protects against concurrent overdrafts and duplicate requests, and maintains an append-only audit ledger with replay-safe webhook handling.
