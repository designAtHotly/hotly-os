import { Text } from "@react-email/components";

import { HotlyLayout, bodyText } from "./layout";

export function GuestReplyEmail() {
  return (
    <HotlyLayout
      preview="The creator replied to your Penpal conversation."
      heading="The creator wrote back"
      actionUrl="{{CHAT}}"
      actionLabel="Open chat"
    >
      <Text style={bodyText}>There is a new reply in your Penpal conversation. Open chat on this instance to read it.</Text>
    </HotlyLayout>
  );
}

export default GuestReplyEmail;
