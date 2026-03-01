## Summary

## Test Plan
- [ ] Typecheck
- [ ] Lint
- [ ] Unit
- [ ] Integration
- [ ] Security scan
- [ ] Agent review check

## Rollback Plan
- [ ] Revert PR
- [ ] Restore previous deployment
- [ ] Open incident issue with failure metrics

<!-- agent-metadata:start -->
{
  "workItemId": 0,
  "risk": "low",
  "testPlan": ["Add tests"],
  "rollbackPlan": ["Revert PR"],
  "policyResult": {
    "allowed": false,
    "violations": ["Awaiting reviewer policy evaluation"],
    "requiredChecks": [
      "typecheck",
      "lint",
      "unit",
      "integration",
      "security",
      "agentReview"
    ]
  }
}
<!-- agent-metadata:end -->
