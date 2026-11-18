import { Button, type ButtonProps } from "./Button";
import { twMerge } from "tailwind-merge";

export function ConfirmButton({ className, ...props }: ButtonProps) {
    return <Button {...props} className={twMerge(className,
        "!bg-green-700 !text-white hover:!bg-green-800 hover:!text-white focus-visible:!bg-green-800 focus-visible:!outline-green-700 disabled:!bg-j-gray-200 disabled:!text-j-gray-500",
    )} />;
}
