// ABOUTME: Settings Documents tab — compliance document availability without vendor-branded placeholder copy

type AvailableDocument = {
  title: string;
  descriptions: string[];
  status: "available";
  file: string;
};

type UnavailableDocument = {
  title: string;
  descriptions: string[];
  status: "unavailable";
};

type SettingsDocument = AvailableDocument | UnavailableDocument;

const DOCUMENTS: SettingsDocument[] = [
  {
    title: "Penetration test",
    descriptions: [
      "Penetration testing is performed at least annually by third-party cybersecurity company, Oneleet.",
      "You can download the Letter of Attestation below.",
    ],
    file: "/static/documents/penetration-test.pdf",
    status: "available",
  },
  {
    title: "SOC 2",
    descriptions: [
      "SOC 2 is a compliance framework developed by AICPA for service organizations.",
      "OpenSend does not currently provide a self-service SOC 2 report in the dashboard. We will publish an OpenSend-specific report here when it is available.",
    ],
    status: "unavailable",
  },
  {
    title: "DPA",
    descriptions: [
      "Data Processing Agreement (DPA) is a contract that regulates data processing conducted for business purposes.",
      "OpenSend does not currently provide a self-service DPA download in the dashboard. Contact support if your organization needs a DPA before it is available here.",
    ],
    status: "unavailable",
  },
  {
    title: "Form W-9",
    descriptions: [
      "Form W-9 is a tax document used in the United States to provide a taxpayer identification number (TIN) to a person or entity that will be making payments.",
      "The attached Form W-9 is a version signed by us.",
    ],
    file: "/static/documents/form-w9.pdf",
    status: "available",
  },
];

export function DocumentsTab() {
  return (
    <div className="space-y-4">
      {DOCUMENTS.map((doc) => (
        <div
          key={doc.title}
          className="border border-[rgba(176,199,217,0.145)] rounded-lg p-6"
        >
          <h3 className="text-[15px] font-semibold text-[#F0F0F0] mb-3">
            {doc.title}
          </h3>
          {doc.descriptions.map((desc) => (
            <p
              key={desc}
              className="text-[14px] text-[#A1A4A5] mb-2 leading-relaxed"
            >
              {desc}
            </p>
          ))}
          {doc.status === "available" ? (
            <a
              href={doc.file}
              className="mt-2 inline-flex items-center px-3 py-1.5 text-[13px] font-medium text-[#F0F0F0] bg-[rgba(176,199,217,0.08)] border border-[rgba(176,199,217,0.145)] rounded-md hover:bg-[rgba(176,199,217,0.15)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download
            </a>
          ) : (
            <span className="mt-2 inline-flex items-center px-3 py-1.5 text-[13px] font-medium text-[#A1A4A5] bg-[rgba(176,199,217,0.04)] border border-dashed border-[rgba(176,199,217,0.145)] rounded-md">
              Unavailable
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
