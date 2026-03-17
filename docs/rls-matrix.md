# RLS Access Matrix

This matrix documents the expected read/write behavior for all current tables.

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | Public can read (`select using true`) | Auth user can create own row (`auth.uid() = user_id`) | Auth user can update own row (`auth.uid() = user_id`) | No explicit policy |
| `physical_profiles` | Own rows only (`auth.uid() = user_id`) | Own rows only | Own rows only | Own rows only |
| `mental_profiles` | Own rows only | Own rows only | Own rows only | Own rows only |
| `meal_logs` | Own rows only | Own rows only | Own rows only | Own rows only |
| `vitamin_analysis` | Own rows only | Own rows only | Own rows only | Own rows only |
| `workout_plans` | Own rows only | Own rows only | Own rows only | Own rows only |
| `workout_logs` | Own rows only | Own rows only | Own rows only | Own rows only |
| `daily_tasks` | Own rows only | Own rows only | Own rows only | Own rows only |
| `streaks` | Own rows only | Own rows only | Own rows only | Own rows only |
| `social_connections` | Public can read all rows | Auth user can insert if `follower_id = auth.uid()` | No explicit policy | Auth user can delete own follow rows |
| `feed_posts` | Public rows or own rows | Own rows only | Own rows only | Own rows only |

## Notes

- The `profiles` bootstrap trigger (`handle_new_user`) ensures every auth user has exactly one profile row.
- Storage policies are defined for `avatars` and `meal_photos` buckets in the initial migration.
- If private profile visibility is required later, `profiles` select policy should be narrowed and public data moved to a separate public view.
