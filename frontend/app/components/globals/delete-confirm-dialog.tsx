/**
 * DeleteConfirmDialog — Reusable AlertDialog for delete confirmations.
 *
 * Follows the Aura v2 design system with:
 * - Destructive-styled icon and button
 * - Clean header with title + description
 * - Loading state for async deletes
 */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TrashIcon, LoaderIcon } from "lucide-react";

interface DeleteConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should open or close */
  onOpenChange: (open: boolean) => void;
  /** Title text (e.g. 'Delete "Mathematics"?' ) */
  title: string;
  /** Longer description explaining the consequences */
  description: string;
  /** Called when the user confirms deletion */
  onConfirm: () => void;
  /** Whether the delete operation is in progress */
  isLoading?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isLoading = false,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TrashIcon className="size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <LoaderIcon className="mr-1.5 size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <TrashIcon className="mr-1.5 size-4" />
                Delete
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
