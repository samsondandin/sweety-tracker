import React, { useState, useEffect, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.profile) {
      setFullName(user.profile.full_name || user.name || '');
      setDisplayName(user.profile.display_name || '');
      setTimezone(user.profile.timezone || 'UTC');
    } else if (user) {
      setFullName(user.name || '');
      setDisplayName(user.name || '');
    }
  }, [user, open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        display_name: displayName.trim() || null,
        timezone: timezone.trim() || 'UTC'
      });
      toast.success('Profile updated.');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Could not update profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your profile</DialogTitle>
          <DialogDescription>Personalize how your name appears in your journal.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-full-name">Full name</Label>
            <Input
              id="profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-display-name">Display name</Label>
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Jane"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-timezone">Time zone</Label>
            <Input
              id="profile-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. America/New_York"
            />
            <p className="text-xs text-muted-foreground">Standard IANA time zone identifier.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

