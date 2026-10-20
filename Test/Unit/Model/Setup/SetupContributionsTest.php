<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\CoreContribution;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SetupContributions;
use PHPUnit\Framework\TestCase;

/**
 * The contribution pool keeps its contributions in registration order and refuses anything else; the shell's own
 * contribution gives its phrases and imports as registered, no plugin and no extension data
 */
class SetupContributionsTest extends TestCase
{
    /**
     * Contributions come back in registration order
     *
     * @return void
     */
    public function testPoolKeepsRegistrationOrder(): void
    {
        $first = new CoreContribution(['a' => 'A']);
        $second = new CoreContribution(['b' => 'B']);

        $pool = new SetupContributions(['x' => $first, 'y' => $second]);

        self::assertSame([$first, $second], $pool->getContributions());
    }

    /**
     * An item that is not a contribution fails when the pool is built
     *
     * @return void
     */
    public function testPoolRefusesWhatIsNotAContribution(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('The setup contribution "broken" must implement');

        new SetupContributions(['broken' => new \stdClass()]);
    }

    /**
     * The shell's contribution answers what it was given
     *
     * @return void
     */
    public function testCoreContribution(): void
    {
        $contribution = new CoreContribution(
            ['wizard.title' => 'GA4 setup'],
            ['preact' => 'Vendor_Module::js/vendor/preact.js']
        );

        self::assertSame(['wizard.title' => 'GA4 setup'], $contribution->getPhrases());
        self::assertSame(['preact' => 'Vendor_Module::js/vendor/preact.js'], $contribution->getImports());
        self::assertSame([], $contribution->getPlugins());
        self::assertSame([], $contribution->getExtensionData());
    }

    /**
     * A phrase that is not text keyed by text fails when the contribution is built
     *
     * @return void
     */
    public function testCoreContributionRefusesNonTextPhrase(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('The setup phrase "wizard.count" must be text keyed by text.');

        new CoreContribution(['wizard.count' => ['one' => 'x']]);
    }
}
