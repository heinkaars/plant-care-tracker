// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays } from 'date-fns';
import type { NewPlant } from '@/types/plant';

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockCompressImageFile = vi.fn();
vi.mock('@/lib/image', () => ({
  compressImageFile: (...args: unknown[]) => mockCompressImageFile(...args),
}));

// next/image needs a real img element under the hood to assert on; the
// loader/optimization machinery it layers on top isn't under test here.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} />;
  },
}));

// vi.mock calls are hoisted above this import by vitest.
const { default: AddPlantModal } = await import('@/components/AddPlantModal');

const fetchMock = vi.fn();

describe('AddPlantModal', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ hemisphere: 'northern' });
    mockCompressImageFile.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('requires a name before submitting the manual form', async () => {
    const user = userEvent.setup();
    const onPlantAdded = vi.fn();
    render(<AddPlantModal onClose={vi.fn()} onPlantAdded={onPlantAdded} />);

    await user.click(screen.getByRole('button', { name: 'Add Plant' }));

    expect(await screen.findByText('Plant name is required')).toBeTruthy();
    expect(onPlantAdded).not.toHaveBeenCalled();
  });

  it('builds a NewPlant from the manual form, seeding nextDueDate from the current frequency', async () => {
    const user = userEvent.setup();
    const onPlantAdded = vi.fn().mockResolvedValue(true);
    render(<AddPlantModal onClose={vi.fn()} onPlantAdded={onPlantAdded} />);

    await user.type(screen.getByPlaceholderText('e.g., My Monstera'), 'My Monstera');
    await user.click(screen.getByRole('button', { name: 'Add Plant' }));

    await waitFor(() => expect(onPlantAdded).toHaveBeenCalledTimes(1));

    const plant = onPlantAdded.mock.calls[0][0] as NewPlant;
    expect(plant.name).toBe('My Monstera');
    expect(plant.careSchedules).toHaveLength(3);

    const watering = plant.careSchedules.find((s) => s.type === 'watering')!;
    expect(watering.frequencyDays).toBe(7);
    expect(watering.nextDueDate).toBe(addDays(new Date('2026-06-15T00:00:00.000Z'), 7).toISOString());
  });

  it('shows a save error without closing the modal when onPlantAdded reports failure', async () => {
    const user = userEvent.setup();
    const onPlantAdded = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(<AddPlantModal onClose={onClose} onPlantAdded={onPlantAdded} />);

    await user.type(screen.getByPlaceholderText('e.g., My Monstera'), 'My Monstera');
    await user.click(screen.getByRole('button', { name: 'Add Plant' }));

    expect(await screen.findByText('Could not save this plant. Check your connection and try again.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('seeds nextDueDate as null when the AI-provided current-season frequency is 0 (ISSUES.md #2)', async () => {
    const user = userEvent.setup();
    // June resolves to 'summer' in the northern hemisphere (the mocked
    // useAuth default), so a summer frequency of 0 is the "skip this
    // season" case ISSUES.md #2 fixed.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Dormant Succulent',
        watering: { spring: 10, summer: 14, fall: 10, winter: 21 },
        fertilizing: { spring: 14, summer: 0, fall: 14, winter: 0 },
        repotting: { spring: 365, summer: 365, fall: 365, winter: 365 },
      }),
    } as Response);

    const onPlantAdded = vi.fn().mockResolvedValue(true);
    render(<AddPlantModal onClose={vi.fn()} onPlantAdded={onPlantAdded} />);

    await user.click(screen.getByRole('button', { name: '🔍 AI Search' }));
    await user.type(screen.getByPlaceholderText(/a succulent with thick leaves/), 'succulent');
    await user.click(screen.getByRole('button', { name: 'Search with AI' }));
    await screen.findByDisplayValue('Dormant Succulent');

    await user.click(screen.getByRole('button', { name: 'Add Plant' }));

    await waitFor(() => expect(onPlantAdded).toHaveBeenCalledTimes(1));
    const plant = onPlantAdded.mock.calls[0][0] as NewPlant;
    const fertilizing = plant.careSchedules.find((s) => s.type === 'fertilizing')!;
    expect(fertilizing.nextDueDate).toBeNull();
  });

  it('runs an AI search, prefills the manual form, and switches back to it', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Monstera Deliciosa',
        scientificName: 'Monstera deliciosa',
        watering: { spring: 5, summer: 5, fall: 7, winter: 10 },
        fertilizing: { spring: 14, summer: 14, fall: 30, winter: 0 },
        repotting: { spring: 365, summer: 365, fall: 365, winter: 365 },
        careNotes: 'Likes bright indirect light.',
      }),
    } as Response);

    render(<AddPlantModal onClose={vi.fn()} onPlantAdded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '🔍 AI Search' }));
    await user.type(
      screen.getByPlaceholderText(/a succulent with thick leaves/),
      'monstera',
    );
    await user.click(screen.getByRole('button', { name: 'Search with AI' }));

    expect(await screen.findByDisplayValue('Monstera Deliciosa')).toBeTruthy();
    expect(screen.getByDisplayValue('5')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search-plant',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows the API-provided error instead of blaming the API key (ISSUES.md #18)', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests' }),
    } as Response);

    render(<AddPlantModal onClose={vi.fn()} onPlantAdded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '🔍 AI Search' }));
    await user.type(
      screen.getByPlaceholderText(/a succulent with thick leaves/),
      'monstera',
    );
    await user.click(screen.getByRole('button', { name: 'Search with AI' }));

    expect(await screen.findByText('Too many requests')).toBeTruthy();
  });

  it('identifies a plant from a camera photo via the compressed image', async () => {
    mockCompressImageFile.mockResolvedValue('data:image/jpeg;base64,compressed');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Snake Plant',
        watering: { spring: 14, summer: 14, fall: 14, winter: 21 },
        fertilizing: { spring: 30, summer: 30, fall: 30, winter: 0 },
        repotting: { spring: 365, summer: 365, fall: 365, winter: 365 },
      }),
    } as Response);

    const user = userEvent.setup();
    render(<AddPlantModal onClose={vi.fn()} onPlantAdded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '📷 Camera' }));
    const file = new File(['photo'], 'plant.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Take or Upload Photo', { selector: 'input' });
    await user.upload(input, file);

    expect(await screen.findByDisplayValue('Snake Plant')).toBeTruthy();
    expect(mockCompressImageFile).toHaveBeenCalledWith(file);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/identify-plant',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ image: 'data:image/jpeg;base64,compressed' }),
      }),
    );
  });
});
