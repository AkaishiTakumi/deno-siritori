interface UUID {
  uuid?: string;
}

interface StandbyRequestBody {
  userName?: string;
  magicWord?: string;
  isHost?: boolean;
};

interface PostNextWordRequestBody {
  roomId: UUID;
  previousWord?: string;
  nextWord?: string;
}

export type { PostNextWordRequestBody, StandbyRequestBody, UUID };
