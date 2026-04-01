interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}
