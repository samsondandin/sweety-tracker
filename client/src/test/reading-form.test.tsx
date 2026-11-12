import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReadingDialog } from '../components/ReadingDialog';
import { type GlucoseReading } from '../lib/glucose';

describe('ReadingDialog Form Validation', () => {
  const today = '2026-11-12';
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
  const mockOnOpenChange = vi.fn();

  const renderDialog = (props: Partial<React.ComponentProps<typeof ReadingDialog>> = {}) => {
    return render(
      <ReadingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        editingReading={null}
        existingReadings={[]}
        today={today}
        defaultSlot="Morning (fasting)"
        onSubmit={mockOnSubmit}
        {...props}
      />
    );
  };

  it('displays "Please enter a glucose value." when value input is empty', async () => {
    renderDialog();

    const form = screen.getByTestId('reading-form');
    fireEvent.submit(form);

    expect(await screen.findByText('Please enter a glucose value.')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('displays "Value must be between 40 and 600 mg/dl." when value is less than 40', async () => {
    renderDialog();

    const input = screen.getByLabelText(/glucose value/i);
    fireEvent.change(input, { target: { value: '35' } });

    const form = screen.getByTestId('reading-form');
    fireEvent.submit(form);

    expect(await screen.findByText('Value must be between 40 and 600 mg/dl.')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('displays "Value must be between 40 and 600 mg/dl." when value is greater than 600', async () => {
    renderDialog();

    const input = screen.getByLabelText(/glucose value/i);
    fireEvent.change(input, { target: { value: '650' } });

    const form = screen.getByTestId('reading-form');
    fireEvent.submit(form);

    expect(await screen.findByText('Value must be between 40 and 600 mg/dl.')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('displays "Date cannot be in the future." when date is beyond today', async () => {
    renderDialog();

    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    const valueInput = screen.getByLabelText(/glucose value/i);
    fireEvent.change(valueInput, { target: { value: '110' } });

    const form = screen.getByTestId('reading-form');
    fireEvent.submit(form);

    expect(await screen.findByText('Date cannot be in the future.')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('displays "You already have an [Slot Name] reading for this date." when slot already exists', async () => {
    const existing: GlucoseReading[] = [
      {
        id: '1',
        reading_date: today,
        time_slot: 'Morning (fasting)',
        value_mg_dl: 95
      }
    ];

    renderDialog({
      existingReadings: existing,
      defaultSlot: 'Morning (fasting)'
    });

    const valueInput = screen.getByLabelText(/glucose value/i);
    fireEvent.change(valueInput, { target: { value: '100' } });

    const form = screen.getByTestId('reading-form');
    fireEvent.submit(form);

    expect(
      await screen.findByText('You already have an Morning (fasting) reading for this date.')
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('displays "You can add only 4 readings per day." when date already has 4 entries', async () => {
    const existing: GlucoseReading[] = [
      { id: '1', reading_date: today, time_slot: 'Morning (fasting)', value_mg_dl: 90 },
      { id: '2', reading_date: today, time_slot: 'After breakfast', value_mg_dl: 120 },
      { id: '3', reading_date: today, time_slot: 'After lunch', value_mg_dl: 130 },
      { id: '4', reading_date: today, time_slot: 'After dinner', value_mg_dl: 140 }
    ];

    renderDialog({
      existingReadings: existing,
      defaultSlot: 'Morning (fasting)'
    });

    const valueInput = screen.getByLabelText(/glucose value/i);
    fireEvent.change(valueInput, { target: { value: '105' } });

    const form = screen.getByTestId('reading-form');
    fireEvent.submit(form);

    expect(await screen.findByText('You can add only 4 readings per day.')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits successfully when input is valid', async () => {
    renderDialog();

    const valueInput = screen.getByLabelText(/glucose value/i);
    fireEvent.change(valueInput, { target: { value: '105' } });

    const form = screen.getByTestId('reading-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        reading_date: today,
        time_slot: 'Morning (fasting)',
        value_mg_dl: 105
      });
    });
  });
});

