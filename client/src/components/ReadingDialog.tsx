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
import { Alert, AlertDescription } from './ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  READING_SLOTS,
  validateReading,
  type GlucoseReading,
  type ReadingSlot
} from '../lib/glucose';

interface ReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingReading: GlucoseReading | null;
  existingReadings: GlucoseReading[];
  today: string;
  defaultSlot?: ReadingSlot;
  defaultDate?: string;
  onSubmit: (readingData: { reading_date: string; time_slot: string; value_mg_dl: number }) => Promise<void>;
}

export function ReadingDialog({
  open,
  onOpenChange,
  editingReading,
  existingReadings,
  today,
  defaultSlot = 'Morning (fasting)',
  defaultDate,
  onSubmit
}: ReadingDialogProps) {
  const [date, setDate] = useState(defaultDate || today);
  const [slot, setSlot] = useState<string>(defaultSlot);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingReading) {
      setDate(editingReading.reading_date);
      setSlot(editingReading.time_slot);
      setValue(String(editingReading.value_mg_dl ?? editingReading.value ?? ''));
    } else {
      setDate(defaultDate || today);
      setSlot(defaultSlot);
      setValue('');
    }
    setError('');
  }, [editingReading, open, today, defaultDate, defaultSlot]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Client-side strict validation
    const validationError = validateReading(
      value,
      date,
      slot,
      existingReadings,
      today,
      editingReading?.id
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        reading_date: date,
        time_slot: slot,
        value_mg_dl: parseInt(value.trim(), 10)
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save glucose reading.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingReading ? 'Edit reading' : 'Add a reading'}</DialogTitle>
          <DialogDescription>Enter the value from your blood glucose meter.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="reading-form">
          <div className="space-y-2">
            <Label htmlFor="reading-date">Date</Label>
            <Input
              id="reading-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reading-slot">Time of day</Label>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger id="reading-slot">
                <SelectValue placeholder="Select time of day" />
              </SelectTrigger>
              <SelectContent>
                {READING_SLOTS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reading-value">Glucose value (mg/dL)</Label>
            <Input
              id="reading-value"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 105"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>

          {error ? (
            <Alert variant="destructive" data-testid="reading-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : editingReading ? 'Save changes' : 'Save reading'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

