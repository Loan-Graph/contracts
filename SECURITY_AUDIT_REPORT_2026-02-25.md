# LoanGraph Smart Contract Security Audit Report

- Date: 2026-02-25
- Auditor: Codex (internal pass)
- Scope: Solidity contracts + deploy config
- Severity model: Conservative
- Codebase root: `loangraph/contracts`
- Test status during audit: `26 passing` (`npm test`)

## Executive Summary
The current suite is cleanly structured and test-covered for happy/negative paths, but it has several high-impact trust and integrity issues around loan mutation authority and repayment accounting. The most serious issue is that **any account with `LENDER_ROLE` can mutate any lender's loan** (repayment/default), which breaks core data integrity and opens direct sabotage/manipulation paths.

Overall risk posture (current state): **Medium-High**.

## Remediation Progress (Updated)
- Resolved:
  - LG-01 (cross-lender unauthorized mutation)
  - LG-02 (unbounded repayment inflation)
  - LG-03 (passport mint for nonexistent borrower)
  - LG-06 (missing pause/unpause events)
- Partially resolved:
  - LG-04 (manager burn confiscation): now requires holder allowance for third-party burn.
  - LG-05 (governance centralization): deploy script now blocks EOA admin by default unless explicit override.
- Remaining:
  - Governance hardening is still operationally dependent on deployment discipline (multisig/timelock process and role lifecycle playbook).

## Methodology
- Manual review of all in-scope contracts and deploy config.
- Role/privilege surface mapping and state-transition review.
- Invariant and abuse-path analysis.
- Existing test coverage review.
- Dynamic baseline validation by running contract test suite.

## Findings

### LG-01: Cross-lender unauthorized mutation of loan state
- Severity: **High**
- Affected:
  - `loangraph/contracts/contracts/LoanRegistry.sol:109`
  - `loangraph/contracts/contracts/LoanRegistry.sol:131`
  - `loangraph/contracts/contracts/LoanRegistry.sol:93`
- Description:
  - `recordRepayment` and `markDefault` only check `LENDER_ROLE`; they do not check `msg.sender == loan.lender`.
  - Any lender can repay/default a loan created by a different lender.
- Impact:
  - Portfolio sabotage (mark competitor loans defaulted).
  - Score manipulation via unauthorized repayment/default calls.
  - Loss of trust in the registry as source-of-truth.
- Exploit path:
  1. Lender A registers loan `X`.
  2. Lender B (also `LENDER_ROLE`) calls `markDefault(X)` or `recordRepayment(X, amount)`.
  3. Loan and borrower aggregates mutate under wrong actor.
- Recommendation:
  - Enforce lender ownership for loan mutation:
    - `if (loan.lender != msg.sender) revert UnauthorizedLenderForLoan(loanId, msg.sender);`
  - Add dedicated custom error.

### LG-02: Unbounded repayment enables score inflation and accounting distortion
- Severity: **High**
- Affected:
  - `loangraph/contracts/contracts/LoanRegistry.sol:117`
  - `loangraph/contracts/contracts/LoanRegistry.sol:120`
  - `loangraph/contracts/contracts/CreditScoreEngine.sol:45`
- Description:
  - `recordRepayment` allows arbitrary repayment amount, including overpayment far beyond principal.
  - `cumulativeRepaid` can exceed `cumulativeBorrowed` materially.
- Impact:
  - Artificially increases repayment ratio and score output quality signal.
  - Distorts investor analytics and borrower ranking.
- Exploit path:
  1. Authorized lender repeatedly calls large repayment amounts.
  2. Borrower aggregate is inflated.
  3. `computeScore` rewards inflated ratio (bounded only at final score cap).
- Recommendation:
  - Bound per-loan repayment to remaining principal (or configured total due) and cap borrower cumulative updates accordingly.
  - Add error `RepaymentExceedsOutstanding(loanId, attempted, outstanding)`.

### LG-03: Passport can be minted for nonexistent/invalid borrower identity
- Severity: **Medium**
- Affected:
  - `loangraph/contracts/contracts/PassportNFT.sol:53`
  - `loangraph/contracts/contracts/PassportNFT.sol:55`
- Description:
  - `mintPassport` does not validate `borrowerId != bytes32(0)` and does not verify borrower has registry history.
- Impact:
  - Ghost passports can be minted and represented as identity artifacts.
  - Noise in analytics and off-chain indexing assumptions.
- Recommendation:
  - Validate nonzero borrower id.
  - Optionally require borrower existence: `loanRegistry.getBorrower(borrowerId).borrowerId != 0`.

### LG-04: Pool manager can burn tokens from any holder without holder consent
- Severity: **Medium**
- Affected:
  - `loangraph/contracts/contracts/PoolToken.sol:75`
- Description:
  - `MANAGER_ROLE` can call `burn(from, amount)` for any address; no allowance/consent model.
- Impact:
  - Centralized confiscation risk if manager key compromised or abused.
  - Should be explicitly codified as a trust assumption.
- Recommendation:
  - Choose one of:
    - Keep model and document custodial risk clearly.
    - Restrict burns to manager-owned addresses.
    - Add holder approval/allowance requirement for third-party burns.

### LG-05: Upgrade/admin governance is operationally centralized by default
- Severity: **Medium**
- Affected:
  - `loangraph/contracts/scripts/deploy.ts:24`
  - `loangraph/contracts/scripts/deploy.ts:30`
  - `loangraph/contracts/scripts/deploy.ts:37`
  - `loangraph/contracts/scripts/deploy.ts:48`
  - `loangraph/contracts/scripts/deploy.ts:59`
- Description:
  - All contracts initialize with one `adminAddress` controlling default admin and upgrader role inheritance model.
  - No enforced multisig/timelock path in deploy workflow.
- Impact:
  - Single-key compromise can result in full protocol takeover/upgrade abuse.
- Recommendation:
  - Use multisig as admin/upgrader from deployment day 0.
  - Enforce post-deploy role transfer and role-renounce sequence in deployment script.
  - Add explicit deployment assertions that admin is a multisig address.

### LG-06: Missing pause/unpause events reduce incident observability
- Severity: **Low**
- Affected:
  - `loangraph/contracts/contracts/LoanRegistry.sol:66`
  - `loangraph/contracts/contracts/PoolToken.sol:56`
- Description:
  - Pause state changes are not emitted as events.
- Impact:
  - Harder to monitor emergency operations from indexers/alerts.
- Recommendation:
  - Emit `Paused(address)` / `Unpaused(address)` events for both contracts.

### LG-07: Deployment address persistence can overwrite wrong environment entry
- Severity: **Low**
- Affected:
  - `loangraph/contracts/scripts/deploy.ts:13`
  - `loangraph/contracts/scripts/deploy.ts:73`
- Description:
  - Address storage key is based on `network.name`; no chain-id validation guard before write.
- Impact:
  - Operator can persist valid addresses under incorrect key via wrong network config naming.
- Recommendation:
  - Validate expected chain IDs and only allow recognized network names before write.

## Positive Security Notes
- UUPS constructors disable initializers correctly.
- Role checks are custom-error based and explicit.
- Soulbound transfer guard in `PassportNFT` is properly enforced on transfer path.
- Comprehensive baseline test suite exists with unit and integration coverage.

## Test Gap Matrix

1. Missing: cross-lender mutation negative tests
- Needed:
  - lender B cannot repay/default lender A loans.

2. Missing: overpayment ceiling tests
- Needed:
  - repayment > outstanding reverts.
  - cumulative borrower values remain bounded.

3. Missing: passport mint borrower validity tests
- Needed:
  - zero borrower id reverts.
  - nonexistent borrower mint policy tested.

4. Missing: explicit governance tests
- Needed:
  - deploy-time admin/upgrader multisig assumptions.
  - role transfer/renounce hardening sequence.

5. Missing: pause observability tests
- Needed:
  - pause/unpause events emitted and indexable.

## Prioritized Remediation Checklist

### Priority 0 (before any production exposure)
- [ ] Enforce loan ownership checks in `recordRepayment` and `markDefault`.
- [ ] Implement outstanding principal caps for repayments.
- [ ] Add tests for cross-lender calls and overpayment attempts.

### Priority 1 (pre-mainnet hardening)
- [ ] Decide and implement `PoolToken.burn` authority model (custodial vs allowance-based).
- [ ] Validate borrower identity constraints in `mintPassport`.
- [ ] Add governance-safe deploy flow (multisig/timelock assumptions + assertions).

### Priority 2 (operational robustness)
- [ ] Emit pause/unpause events in `LoanRegistry` and `PoolToken`.
- [ ] Add deployment network/chain-id guard before address persistence.
- [ ] Add runbook for key rotation and emergency role revocation.

## Suggested Acceptance Criteria for Audit Closure
- All High findings resolved and tested.
- All Medium findings either resolved or formally accepted with signed risk rationale.
- Updated tests cover all abuse scenarios listed in Test Gap Matrix.
- Deployment script enforces governance constraints and environment validation.
