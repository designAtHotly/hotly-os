export interface SocialUser {
  provider: "google" | "apple";
  id_token: string;
  name?: string; // Optional: for Apple first-time auth
}
