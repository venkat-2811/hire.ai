export function isSalesforceRoleText(value: string | null | undefined): boolean {
  if (!value) return false;
  return /(salesforce|apex|crm developer)/i.test(value);
}

