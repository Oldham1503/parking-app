# Future Visitor Register Scope

Visitor sign-in/out should be treated as a future module, not part of the parking register v1.

## Recommended Future List

Create a separate SharePoint List named `VisitorSessions`.

Suggested columns:

| Display name | Type | Notes |
| --- | --- | --- |
| Title | Single line of text | Auto-filled, for example visitor name plus date |
| Visitor Name | Single line of text | Required |
| Company | Single line of text | Optional |
| Visiting | Single line of text or Person | Person or department being visited |
| Car Registration | Single line of text | Optional |
| Time In | Date and time | Required |
| Time Out | Date and time | Blank while signed in |
| Status | Choice | `Signed In`, `Signed Out` |
| Signed Out By Name | Single line of text | Filled by app |
| Signed Out By Email | Single line of text | Filled by app |
| Notes | Multiple lines of text | Optional |

## Design Principles

- Keep visitor records separate from parking records.
- Reuse the same tablet-first design language.
- Reuse Microsoft 365 permissions.
- Link visitor and parking records only if the business later needs combined reporting.

## Future Questions

- Should visitors self-sign in, or should staff sign them in?
- Is visitor badge printing required?
- Is host notification required?
- Are health, safety, evacuation, or GDPR retention requirements needed?

