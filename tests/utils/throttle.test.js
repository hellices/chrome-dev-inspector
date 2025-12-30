const { throttle } = require('../../src/utils/throttle');

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should execute function immediately on first call', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    throttled('arg1');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg1');
  });

  it('should throttle subsequent calls within wait period', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    throttled('call1');
    throttled('call2');
    throttled('call3');

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('call1');
  });

  it('should execute function after wait period has passed', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    throttled('call1');
    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(50);
    throttled('call2');
    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(50);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('call2');
  });

  it('should preserve function context (this)', () => {
    const obj = {
      value: 42,
      method: jest.fn(function () {
        return this.value;
      }),
    };

    obj.throttledMethod = throttle(function () {
      return obj.method.call(this);
    }, 100);

    obj.throttledMethod();
    expect(obj.method).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple arguments correctly', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    throttled('arg1', 'arg2', 'arg3');
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  it('should only execute last call after throttle period', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    throttled('call1');
    jest.advanceTimersByTime(50);
    throttled('call2');
    jest.advanceTimersByTime(25);
    throttled('call3');

    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(25);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('call3');
  });
});
