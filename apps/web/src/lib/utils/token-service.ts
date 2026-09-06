let signedIn = false;

export function setSignedInFlag(value: boolean) {
  signedIn = value;
}

export function isSignedIn() {
  return signedIn;
}

export function getAccessToken(): string | null {
  return signedIn ? "cookie" : null;
}
