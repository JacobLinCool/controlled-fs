export class ControlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ControlError";
	}
}
