import { Text } from "@react-email/components";

import { HotlyLayout, bodyText } from "./layout";

export function RecoveryEmail() {
  return (
    <HotlyLayout
      preview="Reopen your Penpal chat. This link works once."
      heading="Reopen your Penpal chat"
      actionUrl="{{LINK}}"
      actionLabel="Open chat"
    >
      <Text style={bodyText}>You asked for a way back into your Penpal conversation. The button below opens chat on this instance.</Text>
      <Text style={bodyText}>The link works once and expires in 24 hours. If you did not request this, you can ignore the email.</Text>
    </HotlyLayout>
  );
}

export default RecoveryEmail;
