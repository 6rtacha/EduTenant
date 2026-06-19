import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsBeforeEndTime(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBeforeEndTime',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const endTime = obj['endTime'];

          if (typeof value !== 'string' || typeof endTime !== 'string') {
            return false;
          }

          // "14:00" < "16:00" — plain string comparison works for HH:MM
          return value < endTime;
        },
        defaultMessage() {
          return `startTime must be earlier than endTime`;
        },
      },
    });
  };
}
