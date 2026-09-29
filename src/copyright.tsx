import { contacts } from "@/contact";
import { useLocale } from "@/locale";

export function Copyright() {
	const { t } = useLocale();

	return (
		<a
			target="_blank"
			href={`https://${contacts.companySite}`}
			className="m-0 cursor-pointer select-none text-center text-base text-tpl no-underline hover:brightness-150 sm:mb-4 sm:ml-0.5 sm:mr-4 sm:mt-0.5 sm:text-right"
			rel="noopener"
		>
			{`\u00a9 ${t("copyright")} ${contacts.companyStartYear}-${new Date().getFullYear()}`}
		</a>
	);
}
