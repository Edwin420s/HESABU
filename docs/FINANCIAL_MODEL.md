# Financial Domain Model

## Core distinctions

- **Obligation:** what a person or organisation is expected to pay.
- **Payment attempt:** an attempt to move funds through a rail.
- **Settlement:** evidence that a specific payment actually settled.
- **Expense:** a cost submitted for review.
- **Journal entry:** accounting representation of a financial event.
- **Audit log:** who performed an action and when.

An obligation is not money held by HESABU. The outstanding amount is the original obligation less verified settlements.

## Money representation

Use integer minor units. For KES, `1250.50` is stored as `125050` cents. The currency is stored separately. Avoid floating-point arithmetic and do not sum across currencies without an explicit conversion model.

## Double-entry example

For a verified contribution settlement of KES 1,000:

- Debit: 1000-CASH-CLEARING — KES 1,000
- Credit: 2100-CONTRIBUTIONS-PAYABLE — KES 1,000

The account mapping is a product/accounting policy decision and must be reviewed by a qualified accountant before production use. This MVP uses illustrative account codes.

## Idempotency

Every payment attempt has an idempotency key. A provider's transaction reference or chain transaction identity must be unique. Retries must return the existing result rather than post a second settlement.

## Reversals

Never delete or silently alter a posted journal entry. Production reversal design must create a reversing entry linked to the original, record reason and actor, and preserve the audit trail.
