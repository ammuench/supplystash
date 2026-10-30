import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useSignOut } from "@/hooks/use-sign-out";

const discardWarning = (count: number) =>
  count === 1
    ? "1 change hasn't synced yet and will be lost if you log out."
    : `${count} changes haven't synced yet and will be lost if you log out.`;

/**
 * The log-out button and its discard confirmation. Self-contained so the
 * flow survives the temporary settings screen being replaced; see
 * hooks/use-sign-out.ts for the logic.
 */
export const SignOutButton = () => {
  const { isSigningOut, queuedToDiscard, requestSignOut, confirmSignOut, cancelSignOut } =
    useSignOut();

  return (
    <>
      <Button disabled={isSigningOut} onPress={requestSignOut}>
        <Text>{isSigningOut ? "Signing out…" : "Log Out"}</Text>
      </Button>
      <AlertDialog
        open={queuedToDiscard > 0}
        onOpenChange={(open) => {
          if (!open) {
            cancelSignOut();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsynced changes?</AlertDialogTitle>
            <AlertDialogDescription>{discardWarning(queuedToDiscard)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={confirmSignOut}>
              <Text>Log out anyway</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
