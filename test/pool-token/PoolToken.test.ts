import { expect } from "chai";
import { deployCore } from "../helpers";

describe("PoolToken", function () {
  it("initializes as open pool and allows manager mint", async function () {
    const { poolToken, manager, investor } = await deployCore();
    expect(await poolToken.poolOpen()).to.eq(true);

    await expect(poolToken.connect(manager).mint(investor.address, 1_000n))
      .to.emit(poolToken, "PoolMint")
      .withArgs(investor.address, 1_000n);

    expect(await poolToken.balanceOf(investor.address)).to.eq(1_000n);
  });

  it("blocks mint when pool is closed", async function () {
    const { poolToken, admin, manager, investor } = await deployCore();

    await poolToken.connect(admin).setPoolOpen(false);

    await expect(poolToken.connect(manager).mint(investor.address, 100n)).to.be.revertedWithCustomError(
      poolToken,
      "PoolClosed"
    );
  });

  it("allows manager burn", async function () {
    const { poolToken, manager, investor } = await deployCore();

    await poolToken.connect(manager).mint(investor.address, 500n);
    await expect(poolToken.connect(manager).burn(investor.address, 200n))
      .to.emit(poolToken, "PoolBurn")
      .withArgs(investor.address, 200n);

    expect(await poolToken.balanceOf(investor.address)).to.eq(300n);
  });

  it("enforces role checks with custom errors", async function () {
    const { poolToken, other, investor } = await deployCore();
    const managerRole = await poolToken.MANAGER_ROLE();

    await expect(poolToken.connect(other).mint(investor.address, 100n))
      .to.be.revertedWithCustomError(poolToken, "UnauthorizedRole")
      .withArgs(managerRole, other.address);
  });

  it("pause/unpause gates minting via custom errors", async function () {
    const { poolToken, admin, manager, investor } = await deployCore();

    await poolToken.connect(admin).pause();
    await expect(poolToken.connect(manager).mint(investor.address, 10n)).to.be.revertedWithCustomError(
      poolToken,
      "ContractPaused"
    );

    await poolToken.connect(admin).unpause();
    await poolToken.connect(manager).mint(investor.address, 10n);
    expect(await poolToken.balanceOf(investor.address)).to.eq(10n);
  });
});
