import { Text } from "@react-email/components";

import { HotlyLayout, bodyText } from "./layout";

export function CreatorPaidEmail() {
  return (
    <HotlyLayout
      preview={"Someone just sent a paid {{KIND}}."}
      heading={"A new paid {{KIND}}"}
      actionUrl="{{INBOX}}"
      actionLabel="Open inbox"
    >
      <Text style={bodyText}>
        Someone just sent you a paid {"{{KIND}}"}. Open your inbox to read it and write back.
      </Text>
    </HotlyLayout>
  );
}

export default CreatorPaidEmail;
