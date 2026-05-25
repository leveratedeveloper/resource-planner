export function shouldDisableLoginSubmit({
  isAuthLoading,
  isSubmitting,
}: {
  isAuthLoading: boolean;
  isSubmitting: boolean;
}): boolean {
  return isAuthLoading || isSubmitting;
}
