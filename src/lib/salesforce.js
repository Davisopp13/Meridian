const SF_HOST = 'https://hlag.lightning.force.com';

export function caseUrl(sfCaseId) {
  if (!sfCaseId) return null;
  if (!/^500[a-zA-Z0-9]{12,15}$/.test(sfCaseId)) return null;
  return `${SF_HOST}/lightning/r/Case/${sfCaseId}/view`;
}

export function accountUrl(sfAccountId) {
  if (!sfAccountId) return null;
  if (!/^001[a-zA-Z0-9]{12,15}$/.test(sfAccountId)) return null;
  return `${SF_HOST}/lightning/r/Account/${sfAccountId}/view`;
}
