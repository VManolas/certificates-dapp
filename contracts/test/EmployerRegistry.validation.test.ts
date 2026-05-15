// contracts/test/EmployerRegistry.validation.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { 
  EmployerRegistry, 
  InstitutionRegistry, 
  CertificateRegistry 
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EmployerRegistry - Role Conflict Validation", function () {
  let employerRegistry: EmployerRegistry;
  let institutionRegistry: InstitutionRegistry;
  let certificateRegistry: CertificateRegistry;
  let admin: SignerWithAddress;
  let university: SignerWithAddress;
  let student: SignerWithAddress;
  let employer: SignerWithAddress;
  let newUser: SignerWithAddress;

  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("Certificate Document 1"));
  const metadataURI = "ipfs://QmX...";
  const graduationYear = 2024;

  beforeEach(async function () {
    [admin, university, student, employer, newUser] = await ethers.getSigners();

    // Deploy InstitutionRegistry
    const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
    institutionRegistry = await upgrades.deployProxy(
      InstitutionRegistry,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as InstitutionRegistry;
    await institutionRegistry.waitForDeployment();

    // Deploy CertificateRegistry
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    certificateRegistry = await upgrades.deployProxy(
      CertificateRegistry,
      [admin.address, await institutionRegistry.getAddress()],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as CertificateRegistry;
    await certificateRegistry.waitForDeployment();

    // Deploy EmployerRegistry
    const EmployerRegistry = await ethers.getContractFactory("EmployerRegistry");
    employerRegistry = await upgrades.deployProxy(
      EmployerRegistry,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as EmployerRegistry;
    await employerRegistry.waitForDeployment();

    // Link registries
    await institutionRegistry.connect(admin).setCertificateRegistry(
      await certificateRegistry.getAddress()
    );
    
    await employerRegistry.connect(admin).setRegistries(
      await institutionRegistry.getAddress(),
      await certificateRegistry.getAddress()
    );

    // Register and approve university
    await institutionRegistry.connect(university).registerInstitution("MIT", "mit.edu");
    await institutionRegistry.connect(admin).approveInstitution(university.address);
  });

  describe("Registry Configuration", function () {
    it("should set registries correctly", async function () {
      expect(await employerRegistry.institutionRegistry()).to.equal(
        await institutionRegistry.getAddress()
      );
      expect(await employerRegistry.certificateRegistry()).to.equal(
        await certificateRegistry.getAddress()
      );
    });

    it("should revert when non-admin tries to set registries", async function () {
      const ADMIN_ROLE = await employerRegistry.ADMIN_ROLE();
      
      await expect(
        employerRegistry.connect(newUser).setRegistries(
          await institutionRegistry.getAddress(),
          await certificateRegistry.getAddress()
        )
      ).to.be.revertedWithCustomError(
        employerRegistry, 
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should revert when setting zero address institution registry", async function () {
      await expect(
        employerRegistry.connect(admin).setRegistries(
          ethers.ZeroAddress,
          await certificateRegistry.getAddress()
        )
      ).to.be.revertedWith("Invalid institution registry");
    });

    it("should revert when setting zero address certificate registry", async function () {
      await expect(
        employerRegistry.connect(admin).setRegistries(
          await institutionRegistry.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid certificate registry");
    });
  });

  describe("Role Conflict: Admin Cannot Register", function () {
    it("should prevent admin from registering as employer", async function () {
      await expect(
        employerRegistry.connect(admin).registerEmployer("Tech Corp", "VAT123456")
      ).to.be.revertedWith("Admin cannot register as employer");
    });

    it("should allow admin to check status but not register", async function () {
      const ADMIN_ROLE = await employerRegistry.ADMIN_ROLE();
      expect(await employerRegistry.hasRole(ADMIN_ROLE, admin.address)).to.be.true;

      await expect(
        employerRegistry.connect(admin).registerEmployer("Tech Corp", "VAT123456")
      ).to.be.revertedWith("Admin cannot register as employer");
    });
  });

  describe("Role Conflict: University Cannot Register", function () {
    it("should prevent active university from registering as employer", async function () {
      // University is already registered and approved
      expect(await institutionRegistry.canIssueCertificates(university.address)).to.be.true;

      await expect(
        employerRegistry.connect(university).registerEmployer("University Inc", "VAT789012")
      ).to.be.revertedWith("University cannot register as employer");
    });

    it("should prevent pending university from registering as employer", async function () {
      // Register a new university (pending approval)
      const [, , , , , newUniversity] = await ethers.getSigners();
      await institutionRegistry.connect(newUniversity).registerInstitution(
        "Harvard", 
        "harvard.edu"
      );

      // Should still prevent registration (even if pending)
      await expect(
        employerRegistry.connect(newUniversity).registerEmployer("Harvard Corp", "VAT345678")
      ).to.be.revertedWith("University cannot register as employer");
    });

    it("should prevent suspended university from registering as employer", async function () {
      // Suspend the active university
      await institutionRegistry.connect(admin).suspendInstitution(university.address);
      
      // Verify university is suspended (cannot issue certificates)
      expect(await institutionRegistry.canIssueCertificates(university.address)).to.be.false;

      // Suspended university should still NOT be able to register as employer
      await expect(
        employerRegistry.connect(university).registerEmployer("Suspended Uni Corp", "VAT999888")
      ).to.be.revertedWith("University cannot register as employer");
    });
  });

  describe("Role Conflict: Student Cannot Register", function () {
    beforeEach(async function () {
      // Issue certificate to student
      await certificateRegistry.connect(university).issueCertificate(
        sampleHash,
        student.address,
        metadataURI,
        graduationYear
      );
    });

    it("should prevent student with certificate from registering as employer", async function () {
      const certificates = await certificateRegistry.getCertificatesByStudent(student.address);
      expect(certificates.length).to.be.greaterThan(0);

      await expect(
        employerRegistry.connect(student).registerEmployer("Student Startup", "VAT111222")
      ).to.be.revertedWith("Student cannot register as employer");
    });

    it("should prevent student with multiple certificates from registering", async function () {
      // Issue second certificate
      const sampleHash2 = ethers.keccak256(ethers.toUtf8Bytes("Certificate Document 2"));
      await certificateRegistry.connect(university).issueCertificate(
        sampleHash2,
        student.address,
        metadataURI,
        graduationYear
      );

      const certificates = await certificateRegistry.getCertificatesByStudent(student.address);
      expect(certificates.length).to.equal(2);

      await expect(
        employerRegistry.connect(student).registerEmployer("Student Startup", "VAT111222")
      ).to.be.revertedWith("Student cannot register as employer");
    });

    it("should prevent student with revoked certificate from registering", async function () {
      // Revoke the certificate
      const certificates = await certificateRegistry.getCertificatesByStudent(student.address);
      await certificateRegistry.connect(university).revokeCertificate(
        certificates[0], 
        "Test revocation"
      );

      // Student still has a certificate (even if revoked)
      await expect(
        employerRegistry.connect(student).registerEmployer("Student Startup", "VAT111222")
      ).to.be.revertedWith("Student cannot register as employer");
    });
  });

  describe("Successful Registrations", function () {
    it("should allow new user without roles to register as employer", async function () {
      await expect(
        employerRegistry.connect(newUser).registerEmployer("New Company", "VAT555666")
      ).to.not.be.reverted;

      expect(await employerRegistry.isEmployer(newUser.address)).to.be.true;
      
      const employerData = await employerRegistry.getEmployer(newUser.address);
      expect(employerData.companyName).to.equal("New Company");
      expect(employerData.vatNumber).to.equal("VAT555666");
      expect(employerData.isActive).to.be.true;
    });

    it("should allow registration when registries are not set", async function () {
      // Deploy new EmployerRegistry without setting registries
      const EmployerRegistry = await ethers.getContractFactory("EmployerRegistry");
      const newEmployerRegistry = await upgrades.deployProxy(
        EmployerRegistry,
        [admin.address],
        { initializer: "initialize", kind: "uups" }
      ) as unknown as EmployerRegistry;

      // Should allow registration (registries not set = no validation)
      await expect(
        newEmployerRegistry.connect(student).registerEmployer("Any Company", "VAT777888")
      ).to.not.be.reverted;
    });

    it("should increment total employers on successful registration", async function () {
      const initialTotal = await employerRegistry.totalEmployers();
      
      await employerRegistry.connect(newUser).registerEmployer("New Company", "VAT555666");
      
      expect(await employerRegistry.totalEmployers()).to.equal(initialTotal + BigInt(1));
    });
  });

  describe("Edge Cases", function () {
    it("should enforce all role checks in correct order", async function () {
      // Admin check happens first
      await expect(
        employerRegistry.connect(admin).registerEmployer("Test", "VAT")
      ).to.be.revertedWith("Admin cannot register as employer");
    });


    it("should not allow double registration", async function () {
      await employerRegistry.connect(newUser).registerEmployer("Company A", "VAT111");
      
      await expect(
        employerRegistry.connect(newUser).registerEmployer("Company B", "VAT222")
      ).to.be.revertedWith("Already registered");
    });
  });

  describe("Gas Optimization", function () {
    it("should perform validation checks efficiently", async function () {
      const tx = await employerRegistry.connect(newUser).registerEmployer(
        "Gas Test Company", 
        "VAT999"
      );
      const receipt = await tx.wait();
      
      // Ensure gas usage is reasonable
      // Actual: ~251k gas (includes admin check, institution check, certificate check)
      expect(receipt?.gasUsed).to.be.lessThan(280000);
    });
  });
});

