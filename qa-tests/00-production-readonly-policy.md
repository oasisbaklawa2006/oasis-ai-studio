# QA Test 00 - Production Read-Only Policy

## Objective

Ensure Autonoma never mutates production business data during exploratory audits.

## Rules

1. Identify environment before testing.
2. If environment is production, do not sign up, create, edit, save, upload, submit, approve, reject, delete, publish, import, or change settings.
3. If a button may persist data, open only when safe and stop before confirmation.
4. Record `not executed - mutation risk` for unsafe production actions.
5. Use factory-created disposable records only when the Autonoma Environment Factory confirms setup.

## Evidence

- environment URL
- role/account used
- screenshot of landing/authenticated state
- list of skipped mutation steps with reason
