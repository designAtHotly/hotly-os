export class Filter {
  isProfane(_text: string): boolean {
    return false;
  }

  clean(text: string): string {
    return text;
  }
}
