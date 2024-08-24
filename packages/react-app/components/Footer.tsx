import { ArchiveBoxArrowDownIcon, HomeIcon, CogIcon, LockClosedIcon  } from "@heroicons/react/24/outline"
import { useRouter } from "next/router";
type Props = {
  className?: string
}

export default function Footer() {
  const router = useRouter();
  return (
    <footer className="sm:hidden bg-gypsum fixed bottom-0 w-full border-t border-black">
      <div className="flex justify-around py-3">
        <div className="text-xs item-center"> <HomeIcon
          onClick={() => router.push('/')}
          className="m-auto h-6 w-6 cursor-pointer" />
          <p> Home</p>
        </div>
        <div className="text-xs item-center">    <ArchiveBoxArrowDownIcon
          onClick={() => router.push('/miniSafe')}

          className="m-auto h-6 w-6 cursor-pointer" />
          <p> Simple Save</p>
        </div>
        <div className="text-xs item-center">     <LockClosedIcon
          onClick={() => router.push('/vault')}

          className="m-auto h-6 w-6 cursor-pointer" />
          <p> Vault</p>
        </div>
        <div className="text-xs item-center">     <CogIcon
          onClick={() => router.push('/autoSafe')}

          className="m-auto h-6 w-6  cursor-pointer" />
          <p> Auto Save</p>
        </div>
      </div>

    </footer>
  );
}