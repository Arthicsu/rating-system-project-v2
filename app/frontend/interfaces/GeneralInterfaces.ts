
export default interface ApiError {
  response?: {
    data?: Record<string, string[]>;
  };
  message?: string;
}