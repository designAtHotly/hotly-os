import { Text } from "@react-email/components";

import { HotlyLayout, bodyText } from "./layout";

export function CreatorPaidEmail() {
  return (
    <HotlyLayout
      preview={"Someone just sent a Penpal {{KIND}}."}
      heading={"A new Penpal {{KIND}}"}
      actionUrl="{{INBOX}}"
      actionLabel="Open inbox"
    >
      <Text style={bodyText}>
        Someone just sent you a Penpal {"{{KIND}}"}. Open your inbox to read it and write back.
      </Text>
    </HotlyLayout>
  );
}

export default CreatorPaidEmail;
