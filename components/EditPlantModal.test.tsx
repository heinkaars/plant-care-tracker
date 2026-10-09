// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays } from 'date-fns';
import type { Plant } from '@/types/plant';

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockCompressImageFile = vi.fn();
vi.mock('@/lib/image', () => ({
  compressImageFile: (...args: unknown[]) => mockCompressImageFile(...args),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} />;
  },
}));

// vi.mock calls are hoisted above this import by vitest.
const { default: EditPlantModal } = await import('@/components/EditPlantModal');

function makePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 'p1',
    name: 'Fiddle Leaf',
    scientificName: 'Ficus lyrata',
    notes: 'By the window',
    dateAdded: '2026-01-01T00:00:00.000Z',
    careSchedules: [
      { type: 'watering', frequencyDays: 7, lastCareDate: null, nextDueDate: null },
      {
        type: 'fertilizing',
        frequencyDays: 30,
        seasonalFrequency: { spring: 14, summer: 0, fall: 30, winter: 5 },
        lastCareDate: null,
        nextDueDate: null,
      },
      { type: 'repotting', frequencyDays: 365, lastCareDate: null, nextDueDate: null },
    ],
    careHistory: [],
    ...overrides,
  };
}

describe('EditPlantModal', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ hemisphere: 'northern' });
    mockCompressImageFile.mockReset();
    // June resolves to 'summer' in the northern hemisphere.
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('prefills the form from the plant', () => {
    render(<EditPlantModal plant={makePlant()} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByDisplayValue('Fiddle Leaf')).toBeTruthy();
    expect(screen.getByDisplayValue('Ficus lyrata')).toBeTruthy();
    expect(screen.getByDisplayValue('By the window')).toBeTruthy();
  });

  it('requires a name before saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditPlantModal plant={makePlant()} onClose={vi.fn()} onSave={onSave} />);

    await user.clear(screen.getByDisplayValue('Fiddle Leaf'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Plant name is required')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('recomputes nextDueDate from the current frequency on save, treating 0 as skip (ISSUES.md #2/#12)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<EditPlantModal plant={makePlant()} onClose={vi.fn()} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as Plant;

    const watering = saved.careSchedules.find((s) => s.type === 'watering')!;
    expect(watering.nextDueDate).toBe(addDays(new Date('2026-01-01T00:00:00.000Z'), 7).toISOString());

    // Summer fertilizing frequency is 0 in the fixture, so it should stay
    // unscheduled rather than falling due immediately.
    const fertilizing = saved.careSchedules.find((s) => s.type === 'fertilizing')!;
    expect(fertilizing.nextDueDate).toBeNull();
  });

  it('moves nextDueDate when a seasonal frequency is edited', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<EditPlantModal plant={makePlant()} onClose={vi.fn()} onSave={onSave} />);

    const fertilizingCard = screen.getByText('🌱 Fertilizing').parentElement!;
    const [, summerInput] = within(fertilizingCard).getAllByRole('spinbutton');
    await user.clear(summerInput);
    await user.type(summerInput, '20');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as Plant;
    const fertilizing = saved.careSchedules.find((s) => s.type === 'fertilizing')!;
    expect(fertilizing.seasonalFrequency?.summer).toBe(20);
    expect(fertilizing.nextDueDate).toBe(addDays(new Date('2026-01-01T00:00:00.000Z'), 20).toISOString());
  });

  it('shows a save error without closing the modal when onSave reports failure', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(<EditPlantModal plant={makePlant()} onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(
      await screen.findByText('Could not save these changes. Check your connection and try again.'),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('compresses and previews a newly chosen photo', async () => {
    mockCompressImageFile.mockResolvedValue('data:image/jpeg;base64,newphoto');
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    const { container } = render(<EditPlantModal plant={makePlant()} onClose={vi.fn()} onSave={onSave} />);

    const file = new File(['photo'], 'plant.jpg', { type: 'image/jpeg' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(mockCompressImageFile).toHaveBeenCalledWith(file);
    expect(await screen.findByAltText('Plant preview')).toHaveProperty(
      'src',
      'data:image/jpeg;base64,newphoto',
    );

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect((onSave.mock.calls[0][0] as Plant).photo).toBe('data:image/jpeg;base64,newphoto');
  });

  it('shows an error when the chosen photo cannot be read', async () => {
    mockCompressImageFile.mockRejectedValue(new Error('Could not read this image file'));
    const user = userEvent.setup();
    const { container } = render(<EditPlantModal plant={makePlant()} onClose={vi.fn()} onSave={vi.fn()} />);

    const file = new File(['photo'], 'plant.jpg', { type: 'image/jpeg' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(await screen.findByText('Could not read this image file')).toBeTruthy();
  });
});
