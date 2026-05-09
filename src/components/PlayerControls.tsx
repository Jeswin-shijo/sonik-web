import { formatSeconds, isUsableDuration, selectedDurationLabel } from '../helpers/time';
import type { RepeatMode } from '../types';
import { IconButton } from './IconButton';
import { WaveformScrubber } from './WaveformScrubber';

export function PlayerControls({
  trackId,
  progress,
  currentTime,
  duration,
  isPlaying,
  isShuffle,
  repeatMode,
  onProgressChange,
  onPlayToggle,
  onNext,
  onPrevious,
  onShuffleToggle,
  onRepeatToggle,
}: {
  trackId: string;
  progress: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  onProgressChange: (value: number) => void;
  onPlayToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffleToggle: () => void;
  onRepeatToggle: () => void;
}) {
  return (
    <div className="player-controls">
      <div className="transport-row">
        <IconButton
          label={isShuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
          icon="icon-shuffle"
          isActive={isShuffle}
          onClick={onShuffleToggle}
        />
        <IconButton label="Previous track" icon="icon-previous" onClick={onPrevious} />
        <IconButton
          label={isPlaying ? 'Pause' : 'Play'}
          icon={isPlaying ? 'icon-pause' : 'icon-play'}
          isLarge
          onClick={onPlayToggle}
        />
        <IconButton label="Next track" icon="icon-next" onClick={onNext} />
        <IconButton
          label={
            repeatMode === 'one'
              ? 'Turn current song repeat off'
              : 'Repeat current song'
          }
          icon="icon-repeat"
          isActive={repeatMode !== 'off'}
          onClick={onRepeatToggle}
        />
      </div>
      <div className="progress-row">
        <span>{formatSeconds(currentTime)}</span>
        <WaveformScrubber
          trackId={trackId}
          progress={progress}
          height={48}
          onSeek={(ratio) => onProgressChange(ratio * 100)}
        />
        <span>
          {isUsableDuration(duration)
            ? formatSeconds(duration)
            : selectedDurationLabel(progress)}
        </span>
      </div>
    </div>
  );
}
