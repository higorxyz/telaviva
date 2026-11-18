export function Letterbox() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[2.5%] bg-black" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5%] bg-black" />
    </>
  );
}
