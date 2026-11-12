import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from './ui/alert-dialog';
import { type GlucoseReading } from '../lib/glucose';

interface DeleteDialogProps {
  reading: GlucoseReading | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function DeleteDialog({ reading, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={reading !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this reading?</AlertDialogTitle>
          <AlertDialogDescription>
            This reading will be permanently removed from your personal journal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep reading</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
          >
            Delete reading
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

