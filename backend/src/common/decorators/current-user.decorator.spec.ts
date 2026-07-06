import { CurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  it('should be defined', () => {
    expect(CurrentUser).toBeDefined();
  });

  it('should return a function when called', () => {
    const decorator = CurrentUser();
    expect(typeof decorator).toBe('function');
  });
});
