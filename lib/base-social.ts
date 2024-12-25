export abstract class SocialClient {
  public abstract readonly name: string;

  public init(): void | Promise<void> {}

  public abstract post(
    text: string
  ): Promise<{ success: boolean; message: string }>;
}
