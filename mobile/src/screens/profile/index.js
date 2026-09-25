// src/screens/profile/index.js
// Public surface of the profile-pillars module.
//
//   import ProfilePillars from '../screens/profile';
//   <ProfilePillars userId={targetId} isMe={isMe} posts={profile?.posts} />

import ProfilePillars, { PILLARS } from './ProfilePillars';
import useProfileResource from './useProfileResource';
import useProfileUgcActions from './useProfileUgcActions';

export { ProfilePillars, PILLARS, useProfileResource, useProfileUgcActions };
export default ProfilePillars;
